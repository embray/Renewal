import React, { Component } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Constants from 'expo-constants';
import Article from '../../components/Article';
import {
    NavigationActions ,
  } from 'react-navigation';
  /*
  import Header from './Header';
  import ListS from './List';
  import ListV from './ListView';
  import Vide from './Vide';
  import Home from './App';*/
  import {Actions} from 'react-native-router-flux';
  const demoDataNews = [
    //http://www.lefigaro.fr/flash-eco/2018/04/26/97002-20180426FILWWW00129-banlieues-borloo-propose-un-fonds-de-5-milliards-d-euros.php

    {
      title: 'À lui seul, l’iPhone X a compté pour 35 % des bénéfices de l’industrie au Q4 2017',
      rating: 'mer 11:51:16',
      image: 'https://www.numerama.com/content/uploads/2017/11/iphone-x-une-2.jpg',
      large: 'https://www.numerama.com/content/uploads/2017/11/iphone-x-une-2.jpg',
      plot: "Ciblé pour son prix exorbitant, révoltant pour certains, l'iPhone X fait le bonheur des comptes d'Apple.L’iPhone X a une encoche. L’iPhone X est sorti trop tôt. L’iPhone X est cher. Mais l’iPhone X rapporte beaucoup, beaucoup d’argent, suggérant une marge à nulle autre pareille pour Apple. Les chiffres du cabinet d’analyse Counterpoint, partagés par CNBC, mettent en avant la mainmise du flagship ultra premium sur un marché global très stable : durant le quatrième trimestre de l’année 2017, l’iPhone X a pesé pour 35 % des bénéfices à lui tout seul, malgré des ventes supposément inférieures aux attentes de la firme de Cupertino. C’est dire. ",
      url:'https://www.numerama.com/tech/346171-a-lui-seul-liphone-x-a-compte-pour-35-des-benefices-de-lindustrie-au-q4-2017.html'
    },
    {
      title: 'Snapchat permet désormais de créer ses propres filtres pour les visages',
      rating: 'mer 11:51:16',
      image: 'https://www.numerama.com/content/uploads/2017/05/snapchat.jpg',
      large: 'https://www.numerama.com/content/uploads/2017/05/snapchat.jpg',
      plot: "Snapchat permet à ses utilisateurs américains de créer des filtres pour les visages. Ils sont cependant payants, et non permanents, car associés à une localisation et une heure précises.",
      url:'https://www.numerama.com/tech/328280-snapchat-permet-desormais-de-creer-ses-propres-filtres-pour-les-visages.html'
    },
    {
      title: 'Microsoft dévoile un nouvel OS basé sur Linux',
      rating: '18/04/18 à 09h42 ',
      image: 'https://dyw7ncnq1en5l.cloudfront.net/optim/news/73/73481/microsoft-loves-linux-1-750x422.jpg',
      large: 'https://dyw7ncnq1en5l.cloudfront.net/optim/news/73/73481/microsoft-loves-linux-1-750x422.jpg',
      plot: "À Redmond, on a dû beaucoup en rire avant de monter sur scène pour annoncer un système d'exploitation maison basé sur Linux. Le moment quasi historique a eu lieu lors du grand colloque RSA (16-20 avril, San Francisco), spécialement dédié à la sécurité de l'information. Les équipes de Microsoft en ont profité pour présenter une solution complète pour objets connectés et c'est justement là qu'intervient la mise en place d'un OS surprise. Azure Sphere OS, c'est son nom, pourra ainsi équiper tout ce que l'on peut imaginer en solutions connectées pour les entreprises soucieuses de leur sécurité.Le système fait ainsi partie de l'ensemble Azure Sphere, sorte de cercle vertueux réunissant microcontrôleur et système d'exploitation sous l'égide d'une sécurité \"cloud\" chère à Microsoft. C'est donc sur la partie système qu'intervient ce Linux aménagé. Pour le géant américain, il s'agit d'une première en 43 ans, ajoutant faire face à une étape importante pour l'entreprise. Néanmoins, Microsoft s'est déjà rapproché du système créé par Linus Torvalds en accueillant Ubuntu sur le Windows Store ou avec l'intégration de l'interpréteur Bash au sein de Windows 10. ",
      url: 'https://www.lesnumeriques.com/appli-logiciel/microsoft-devoile-nouvel-os-base-sur-linux-n73481.html'

    },
    {
      title: 'WhatsApp est désormais (officiellement) interdit aux moins de 16 ans dans l’UE',
      rating: 'mer 11:48:16',
      image: 'https://www.numerama.com/content/uploads/2018/04/whatsapp.jpg',
      large: 'https://www.numerama.com/content/uploads/2018/04/whatsapp.jpg',
      plot: "Pour se conformer au RGPD qui entre en application le 25 mai 2018 dans l'Union européenne, la messagerie de Facebook relève l'âge minimum d'utilisation de 13 à 16 ans. Mais dans les faits, cette décision semble peu applicable.",
      url: 'https://www.numerama.com/tech/350206-whatsapp-est-desormais-officiellement-interdit-aux-moins-de-16-ans-dans-lue.html'
    },
    {
      title: 'YouTube Kids : les parents peuvent n’autoriser que des vidéos validées par des humains',
      rating: 'hier a 18:27',
      image: 'https://www.numerama.com/content/uploads/2016/05/youtube-1920.jpg',
      large: 'https://www.numerama.com/content/uploads/2016/05/youtube-1920.jpg',
      plot: 'Critiqué pour le fonctionnement de ses algorithmes, YouTube Kids offre désormais la possibilité aux parents de filtrer davantage les contenus. Ils peuvent autoriser la visibilité des de vidéos uniquement validées par des modérateurs humains.',
      url: 'https://www.numerama.com/tech/350639-youtube-kids-les-parents-peuvent-nautoriser-que-des-videos-validees-par-des-humains.html'
    },
    {
      title: 'Quand Google Maps se met à utiliser les fast-foods dans la navigation',
      rating: 'hier 10:06:16',
      image: 'https://dyw7ncnq1en5l.cloudfront.net/optim/news/73/73489/5ad6edf02e75a__300_170.jpg',
      large: 'https://dyw7ncnq1en5l.cloudfront.net/optim/news/73/73489/istock-535415075.jpg',
      plot: "Comme l'attestent plusieurs utilisateurs américains de Google Maps, le service de navigation teste actuellement une nouvelle manière de dicter le guidage qui s'avère être beaucoup plus proche de celle des humains. Ainsi, au lieu d'entendre le sempiternel \"dans 100 mètres, tournez à droite\", Google Maps a commencé à dicter à certains utilisateurs américains intégrés à un échantillon de test des directions telles que : \"Tournez à droite après le Burger King\" ; \"À droite après le White Castle\" ; \"Prenez à droite après le KFC\".Si l'on met de côté la surreprésentation des enseignes de restauration rapide — nous sommes aux États-Unis —, il faut avouer que cette manière de présenter la route à suivre est bien plus claire. Les \"Prendre à gauche au troisième feu\" et autres \"Sortez du rond-point par la quatrième sortie\" pouvant parfois donner lieu à des hésitations."
      ,url: 'https://www.lesnumeriques.com/vie-du-net/quand-google-maps-se-met-a-utiliser-fast-foods-dans-navigation-n73489.html'
    },
    {
      title: 'Snappables : Snapchat veut que vous grimaciez pour jouer',
      rating: 'mer 11:51:16',
      image: 'https://www.numerama.com/content/uploads/2018/04/snappables-hero-shot.jpg',
      large: 'https://www.numerama.com/content/uploads/2018/04/snappables-hero-shot.jpg',
      plot: "Snapchat vient de lancer Snappables, une nouvelle option qui permet de contrôler des jeux en réalité augmentée par les expressions du visage. Ces nouvelles Lenses seront déployées cette semaine sur Android et iOS.",
      url:'https://www.numerama.com/tech/350662-snappables-snapchat-veut-que-vous-grimaciez-pour-jouer.html'
    },
    {
      title: 'Grève à la RATP : le trafic sera légèrement perturbé jeudi',
      rating: '18/04/18 à 09h42 ',
      image: 'http://s1.lprs1.fr/images/2018/04/18/7670484_e1b8f7dc-42e1-11e8-9275-09e60a2c58a8-1_1000x625.jpg',
      large: 'http://s1.lprs1.fr/images/2018/04/18/7670484_e1b8f7dc-42e1-11e8-9275-09e60a2c58a8-1_1000x625.jpg',
      plot:"Ce n’est pas un appel à la grève, « mais plutôt une possibilité offerte aux salariés qui le souhaitent d’aller manifester », explique-t-on à l’Unsa RATP.Les trois organisations syndicales de la RATP (CGT, Sud et Unsa) ont déposé un préavis de grève pour cette nouvelle journée de mobilisation de jeudi. Etudiants, personnels hospitaliers ou encore cheminots ont prévu de manifester pour « stopper la régression sociale ».En conséquence, le trafic sera légèrement perturbé sur les RER et bus, et normal sur le reste du réseau RATP.",
      url: 'http://www.leparisien.fr/info-paris-ile-de-france-oise/transports/preavis-de-greve-a-la-ratp-trafic-legerement-perturbe-ce-jeudi-18-04-2018-7670484.php'

    },
     {
      title: 'Le code d’un téléphone peut être exigé en garde à vue',
      rating: ' 18/04/2018 à 11:30 ',
      image: 'https://img.igen.fr/2018/4/macgpic-1524040054-72614127157932-sc-jpt.jpg',
      large: 'https://img.igen.fr/2018/4/macgpic-1524040054-72614127157932-sc-jpt.jpg',
      plot:"Une décision du Conseil constitutionnel délivrée le 30 mars dernier et signalée cette semaine par le quotidien Le Monde permet aux forces de l’ordre d’exiger le code de déverrouillage d’un téléphone, d’une tablette ou d’un ordinateur à tout suspect en garde à vue. Un refus d’obtempérer est alors passible de poursuites qui peuvent aboutir à une peine de trois ans d’emprisonnement et d’une amende de 270 000 €. ",
      url: 'https://www.igen.fr/ailleurs/2018/04/le-code-dun-telephone-peut-etre-exige-en-garde-vue-103705'
    },
    {
      title: 'Fortnite : une fac américaine offre une bourse aux joueurs talentueux',
      rating: ' 18/04/2018 à 11:30 ',
      image: 'https://www.numerama.com/content/uploads/2018/04/fortnite2fbattle-royale2ffortnite-sniper-1920x1080-f072fcef414cbe680e369a16a8d059d8a01c7636.jpg',
      large: 'https://www.numerama.com/content/uploads/2018/04/fortnite2fbattle-royale2ffortnite-sniper-1920x1080-f072fcef414cbe680e369a16a8d059d8a01c7636.jpg',
      plot:"Le succès de Fortnite ne tarit pas. Le jeu s'offre une place dans le programme esport de l'université américaine de l'Ohio qui, pour marquer le coup, a décidé d'offrir une bourse aux joueurs assez talentueux pour rejoindre leur programme. ",
      url: 'https://www.numerama.com/tech/349224-fortnite-une-fac-americaine-offre-une-bourse-aux-joueurs-talentueux.html'
    },
  ];

const {width, height} = Dimensions.get('window')
console.log(`dimensions: ${height}, ${width}`)


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  endFooter: {
    position: 'relative',
    width: width,
    height: 20,
    alignItems: 'center'
  },
  loadingFooter: {
    position: 'relative',
    width: width,
    height: height / 2,
    paddingVertical: 20,
    borderTopWidth: 1,
    marginTop: 10,
    marginBottom: 10,
    borderColor: '#f2f2f2'
  }
});


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


export default class ListView extends React.Component {
    /**
     * Store the data for ListView
     */
    state = {
        // Used for RefreshControl
      refreshing: false,
      loading: true,
      loadingMore: false,
      endOfData: false,
      data: [],
      page: 0
    }

    /**
     * Call _fetchData after component has been mounted
     */
    async componentDidMount() {
        console.log('ListView.componentDidMount()');
        // Fetch Data
        await this._fetchData();

        /* TODO: I don't think this is needed at all, but as it
         * is it was causing the component to be re-rendered every
         * second, and we need to look into how to avoid that
         * in general in cases where part of the state is constantly
         * being updated.
        setInterval( () => {
          this.setState({
            curTime : new Date().toLocaleString()
          })
        },1000)
        */
      }

    /**
     * Prepare demo data for ListView component
     */
    _fetchData = async () => {
      const { page } = this.state;
      // Data is being refreshed
      await sleep(100);
      const response = demoDataNews.slice(page * 5, (page + 1) * 5);
      this.setState((prevState) => ({
        // Fill up DataSource with demo data
        // Simulate loading data
        data: prevState.page === 0 ? response : [...prevState.data, ...response],
        // Data has been refreshed by now
        refreshing: false,
        loading: false,
        loadingMore: false,
        endOfData: (response.length === 0),
        // set Date
        curTime : new Date().toLocaleString(),
      }));
    }

    _refresh = () => {
      this.setState(
        {page: 0, refreshing: true},
        this._fetchData
      );
    };

    _fetchMore = () => {
      this.setState((prevState) => ({
        page: prevState.page + 1,
        loadingMore: true
      }), () => { this._fetchData(); });
    }

    _renderArticle(item) {
      console.log(`rendering item: ${JSON.stringify(item)}`);
        //const { navigate } = this.props.navigation
        return (
          <Article
            article={item}
            onPress={()=>{
                console.log(`viewing ${item.url}`);
                //Actions.webviewcustom(story)
                Actions.articleView(item);
              }}
          />
        );
      };

      _renderFooter = () => {
        if (this.state.endOfData) {
          return (
            <View style={styles.endFooter}>
              <Text style={{color: 'black', fontWeight: 'bold'}}>·</Text>
            </View>
          );
        } else if (!this.state.loadingMore) {
          return null;
        }

        return (
          <View style={styles.loadingFooter}>
            <ActivityIndicator animating size="large" />
          </View>
        );
      };


      _handleScroll = (event) => {
        const oneRow = (height/3)+5;
        console.log("##################################");
        //console.log(event.nativeEvent);
        //console.log(this.state);
        console.log(this.state.curTime)
        console.log("la taille :"+height);
        const taille = event.nativeEvent.layoutMeasurement.height;
        console.log("La position du scroll :"+event.nativeEvent.contentOffset.y)
        console.log("ta taille de la listView :"+event.nativeEvent.contentSize.height)
        console.log("le nombre de row:"+this.state.data.length);
        console.log("la taille d'un seul row:"+(event.nativeEvent.contentSize.height/this.state.data.length));
        //sachant que l'ecran fait 603



        if(event.nativeEvent.contentOffset.y > (event.nativeEvent.contentSize.height/this.state.data.length)){
          //split('-')[0]
          const logRow = event.nativeEvent.contentOffset.y/(event.nativeEvent.contentSize.height/this.state.data.length)+" ";
          const logRowPercent = "0."+logRow.split('.')[1];
          const logRowID = logRow.split('.')[0]
          console.log("% du premier article afficher : "+(1-logRowPercent));
          console.log("taille en px du premier row affiché "+(1-logRowPercent)*(event.nativeEvent.contentSize.height/this.state.data.length));
          const sizeFistRow = (1-logRowPercent)*(event.nativeEvent.contentSize.height/this.state.data.length);
          const nbDeRow = (taille-sizeFistRow)+" ";
          console.log("reste en px : "+nbDeRow+" le reste en nb : "+ nbDeRow/(event.nativeEvent.contentSize.height/this.state.data.length));
          const logRowLast = nbDeRow/(event.nativeEvent.contentSize.height/this.state.data.length)+ " ";
          const logRowLastPercent = "0."+logRowLast.split('.')[1];
          console.log("% du dernier article afficher : "+logRowLastPercent);
        }else{
          //cas le scroll a pas encore dépassé un article
          //console.log("id du premier article afficher : "+(event.nativeEvent.contentSize.height/this.state.dataSource._cachedRowCount))
          console.log("% du premier article afficher : "+(1-(event.nativeEvent.contentOffset.y/(event.nativeEvent.contentSize.height/this.state.data.length))));
          console.log("taille en px du premier row affiché : "+(1-(event.nativeEvent.contentOffset.y/(event.nativeEvent.contentSize.height/this.state.data.length)))*(event.nativeEvent.contentSize.height/this.state.data.length));
          const sizeFistRow = (1-(event.nativeEvent.contentOffset.y/(event.nativeEvent.contentSize.height/this.state.data.length)))*(event.nativeEvent.contentSize.height/this.state.data.length);

        }




        console.log("##################################");

        //si event.nativeEvent.contentOffset.y + layoutMeasurement.height = contentSize.height
          // > alors l'utilisateur est la fin de la page.
        //console.log("nb de px affiché : "+height+" postion px haut :"+event.nativeEvent.contentOffset.y);
       }
    /**
     * Renders the list
     */

    render() {
        return (
          <SafeAreaView style={styles.container}>
            { !this.state.loading ? (
              <FlatList
                onScroll={this._handleScroll}
                // Data source from state
                data={this.state.data}
                renderItem={({ item }) => this._renderArticle(item)}
                refreshing={this.state.refreshing}
                onRefresh={this._refresh}
                onEndReached={this._fetchMore}
                onEndReachedThreshold={0.5}
                initialNumToRender={5}
                // TODO: For the real app, news items should also have a unique
                // ID to use as their key that would be faster to compare than
                // URLs
                keyExtractor={(item) => item.url}
                ListFooterComponent={this._renderFooter}
              />
            ) : (
              <>
                <Text style={{alignSelf: 'center'}}>Loading news...</Text>
                <ActivityIndicator />
              </>
            )}
          </SafeAreaView>
        );
      }
  }
